import { HuggingFaceHub } from 'langchain';

const llm = new HuggingFaceHub({
  repoId: "google/flan-t5-large",
  modelKwargs: { temperature: 0.7, max_length: 700 }
});

console.log("HuggingFaceHub initialized", llm);
