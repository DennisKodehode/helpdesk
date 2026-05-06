import app from "./app";

if (!process.env.WEBHOOK_SECRET) {
  throw new Error("WEBHOOK_SECRET environment variable is not set");
}

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
