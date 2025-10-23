import chromadb
from langchain_chroma import Chroma
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnablePassthrough, RunnableBranch
from langchain_huggingface.embeddings import HuggingFaceEmbeddings
from langchain_google_genai import ChatGoogleGenerativeAI
import json

from pydantic import BaseModel, Field
from typing import List, Literal
from dotenv import load_dotenv

load_dotenv()

client = chromadb.PersistentClient("chroma_db")


embeddings = HuggingFaceEmbeddings(
    model_name="huyydangg/DEk21_hcmute_embedding",
)


db_retrieved = Chroma(
    client=client,
    collection_name="legal_collection",
    embedding_function=embeddings,
)

retriever = db_retrieved.as_retriever(search_type="similarity", search_kwargs={"k": 5})

llm = ChatGoogleGenerativeAI(model="gemini-2.5-flash", temperature=0)

question_type = "normal"


class Source(BaseModel):
    article_name: str = Field(..., description="Tên của điều luật")
    article_content: str = Field(
        ...,
        description="Nội dung của điều luật, không không chứa số điều, tên điều luật",
    )
    section: str = Field(default="", description="Mục của luật")
    chapter: str = Field(..., description="Chương của luật")
    source_name: str = Field(..., description="Tên luật nguồn")


class RetrievalResult(BaseModel):
    answer: str = Field(..., description="Câu trả lời, định dạng Markdown")
    sources: List[Source] = Field(
        ..., description="Danh sách nguồn kết quả truy vấn, bỏ trống nếu không có"
    )
    type: Literal["normal", "legal"] = Field(
        ..., description="Xác định câu hỏi dạng bình thường hay dạng câu hỏi pháp luật"
    )


class SubQuestion(BaseModel):
    sub_questions: List[str] = Field(..., description="Danh sách các sub-question")


class RouteQuery(BaseModel):
    type: Literal["normal", "legal"]


def get_unique_union(documents: list[list]):
    question_type = "legal"
    """Unique union of retrieved docs"""

    docs_as_dicts = [
        {"page_content": doc.page_content, "metadata": doc.metadata}
        for sublist in documents
        for doc in sublist
    ]

    flattened_docs = [json.dumps(doc) for doc in docs_as_dicts]

    unique_docs = list(set(flattened_docs))

    return [json.loads(doc) for doc in unique_docs]


# subquestions generation chain
structured_llm = llm.with_structured_output(RetrievalResult)

template = """
    Bạn là trợ lý AI hữu ích. Nhiệm vụ của bạn là tạo ra các phiên bản khác nhau của câu hỏi (chủ yếu về pháp luật) 
    người dùng đã cho để lấy các tài liệu liên quan từ cơ sở dữ liệu vector. Bằng cách chia nhỏ 
    câu hỏi gốc thành nhiều câu truy vấn để dễ dàng tìm kiếm các tài liệu một cách độc lập.
    Câu hỏi gốc: {question}.
"""
prompt = ChatPromptTemplate.from_template(template)

structured_llm = llm.with_structured_output(SubQuestion)

generate_sub_question_chain = (
    {"question": RunnablePassthrough()}
    | prompt
    | structured_llm
    | (lambda x: x.sub_questions)
)

retrieval_chain = generate_sub_question_chain | retriever.map() | get_unique_union

# legal Rag chain
structured_llm = llm.with_structured_output(RetrievalResult)

template = """
Bạn là trợ một trợ lý pháp luật thông minh, dựa vào các thông tin pháp luật được trích dẫn dưới đây, hãy trả lời câu hỏi của người dùng một cách chính xác và rõ ràng. Luôn trích dẫn nguồn từ điều, khoản, và tên văn bản đã được cung cấp. Nếu thông tin không có trong văn bản, hãy trả lời rằng bạn không tìm thấy thông tin.
Lưu ý: Trả lời một cách trực tiếp, bỏ qua các lời chào, thông tin ngữ cảnh,...
    [NGỮ CẢNH]
---
{context}
---

[CÂU HỎI NGƯỜI DÙNG]
{question}

[TRẢ LỜI]
"""

prompt = ChatPromptTemplate.from_template(template)

rag_chain = (
    {"question": RunnablePassthrough(), "context": retrieval_chain}
    | prompt
    | structured_llm
    | (lambda x: x.model_dump())
)

# Normal chain
template = """
    Bạn là một trợ lý AI thông minh, nhiệm vụ của bạn là giải đáp thắc mắc của người dùng một cách đầy đủ và chính xác.
    Câu hỏi: {question}
"""

prompt = ChatPromptTemplate.from_template(template)
structured_llm = llm.with_structured_output(RetrievalResult)
normal_chain = (
    {"question": RunnablePassthrough()}
    | prompt
    | structured_llm
    | (lambda x: x.model_dump())
)

# Route chain
template = """
    Bạn là một trợ lý AI thông minh, nhiệm vụ của bạn là xác định xem câu hỏi của người dùng là câu hỏi bình thường hay là về chủ đề pháp luật.
    Câu hỏi: {question}
"""

prompt = ChatPromptTemplate.from_template(template)
structured_llm = llm.with_structured_output(RouteQuery)

route_chain = {"question": RunnablePassthrough()} | prompt | structured_llm

branch = RunnableBranch(
    (lambda x: x["type"].type == "normal", normal_chain),
    rag_chain,
)

# Main chain
main_chain = {"type": route_chain, "question": RunnablePassthrough()} | branch


def chatbot(question):
    response = main_chain.invoke(question)
    return response


# question = "Xin chào"
# question = "Tài sản thừa kế được phân chia cho các con như thế nào?"
# print(chatbot(question))
