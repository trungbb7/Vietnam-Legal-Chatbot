import chromadb
from langchain_chroma import Chroma
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnablePassthrough
from langchain_huggingface.embeddings import HuggingFaceEmbeddings
from langchain_google_genai import ChatGoogleGenerativeAI


from pydantic import BaseModel, Field
from typing import List
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


class Source(BaseModel):
    article_name: str = Field(..., description="Tên của điều luật")
    ariticle_content: str = Field(
        ..., description="Nội dung của điều luật, không chứa tên"
    )
    section: str = Field(default="", description="Mục của luật")
    chapter: str = Field(..., description="Chương của luật")


class RetrievalResult(BaseModel):
    answer: str = Field(..., description="Câu trả lời")
    sources: List[Source] = Field(..., description="Danh sách nguồn kết quả truy vấn")


structured_llm = llm.with_structured_output(RetrievalResult)


def chatbot(question):

    template = """
    Dựa vào các thông tin pháp luật được trích dẫn dưới đây, hãy trả lời câu hỏi của người dùng một cách chính xác và rõ ràng. Luôn trích dẫn nguồn từ điều, khoản, và tên văn bản đã được cung cấp. Nếu thông tin không có trong văn bản, hãy trả lời rằng bạn không tìm thấy thông tin.
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
        {"question": RunnablePassthrough(), "context": retriever}
        | prompt
        | structured_llm
        | (lambda x: x.model_dump())
    )

    return rag_chain.invoke(question)
