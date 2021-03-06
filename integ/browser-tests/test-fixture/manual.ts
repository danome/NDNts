export function addManualTest(title: string, f: () => Promise<string|string[]>) {
  const handler = () => {
    document.querySelectorAll("button").forEach((btn) => btn.disabled = true);
    f().then(
      (result) => {
        if (Array.isArray(result)) {
          result = result.join("\n");
        }
        document.body.textContent = result;
      },
      (err) => document.body.textContent = err,
    );
  };

  window.addEventListener("load", () => {
    const btn = document.createElement("button");
    btn.textContent = title;
    btn.addEventListener("click", handler);
    document.body.append(btn);
    document.body.append(document.createElement("br"));
  });
}
