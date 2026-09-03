import ollama

response = ollama.chat(
    model="deepseek-r1:1.5b",
    messages=[
        {
            "role": "user",
            "content": "你好，请用100字以内介绍川派盆景。"
        }
    ]
)

print(response["message"]["content"])