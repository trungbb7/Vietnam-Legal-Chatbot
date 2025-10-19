from flask import Flask, request, render_template
from flask_cors import CORS
from chatbot import chatbot


app = Flask(__name__)
CORS(app)


@app.route("/", methods=["GET"])
def index():
    return render_template("index.html")


@app.route("/query", methods=["GET"])
def query():
    try:
        query = request.args.get("q", "")
        if len(query) != 0:
            answer = chatbot(query)
            return {"result": answer}
        return {"message": "Invalid argument"}, 400
    except Exception as e:
        print(e)
        return {"message": "Internal Server Error"}, 500


@app.route("/demo", methods=["GET"])
def demo():
    try:
        query = request.args.get("q", "")
        return {"query": query}
    except Exception as e:
        print(e)
        return {"message": "Internal Server Error"}, 500
