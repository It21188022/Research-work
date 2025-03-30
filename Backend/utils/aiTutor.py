import sys
import torch
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM, pipeline

MODEL_PATH = "./models/flan-t5-xl"

def load_model():
    tokenizer = AutoTokenizer.from_pretrained(MODEL_PATH)
    model = AutoModelForSeq2SeqLM.from_pretrained(MODEL_PATH)
    
    return pipeline(
        "text2text-generation",
        model=model,
        tokenizer=tokenizer,
        max_length=512,
        device=0 if torch.cuda.is_available() else -1
    )

def generate_response(question, options, correct_answer):
    pipe = load_model()
    prompt = f"""
    Explain this question step-by-step:
    Question: {question}
    Options: {', '.join(options)}
    Correct Answer: {options[ord(correct_answer) - 65]}
    """
    return pipe(prompt, max_length=512)[0]['generated_text']

if __name__ == "__main__":
    question = sys.argv[1]
    options = sys.argv[2].split('|')
    correct_answer = sys.argv[3]
    print(generate_response(question, options, correct_answer))