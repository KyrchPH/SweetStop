import cors from "cors";
import dotenv from "dotenv";
import express from "express";

dotenv.config();

const app = express();
const port = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.get("/health", (_, res) => {
  res.status(200).json({ status: "ok", service: "sweetstop-pos-server" });
});

app.listen(port, () => {
  console.log(`SweetStop server running on port ${port}`);
});
