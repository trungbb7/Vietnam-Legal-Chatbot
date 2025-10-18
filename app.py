from flask import Flask, request, render_template
from chatbot import chatbot


app = Flask(__name__)


@app.route("/", methods=["GET"])
def index():
    return render_template("index.html")


@app.route("/query", methods=["GET"])
def search_():
    try:
        query = request.args.get("q", "")
        if len(query) != 0:
            answer = chatbot(query)
            return {"result": answer}
        return {"message": "Invalid argument"}, 400
    except Exception as e:
        print(e)
        return {"message": "Internal Server Error"}, 500
