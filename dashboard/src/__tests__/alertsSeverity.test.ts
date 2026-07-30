// Tests de la logique de classification des alertes par severite

type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

function classifySeverity(statusCode: number): Severity {
  if (statusCode >= 500) return "CRITICAL";
  if (statusCode === 429) return "HIGH";
  if (statusCode === 401 || statusCode === 403) return "MEDIUM";
  return "LOW";
}

describe("Classification des alertes par severite", () => {
  it("classifie 500 comme CRITICAL", () => {
    expect(classifySeverity(500)).toBe("CRITICAL");
  });

  it("classifie 503 comme CRITICAL", () => {
    expect(classifySeverity(503)).toBe("CRITICAL");
  });

  it("classifie 429 (rate limit) comme HIGH", () => {
    expect(classifySeverity(429)).toBe("HIGH");
  });

  it("classifie 401 (non authentifie) comme MEDIUM", () => {
    expect(classifySeverity(401)).toBe("MEDIUM");
  });

  it("classifie 403 (interdit) comme MEDIUM", () => {
    expect(classifySeverity(403)).toBe("MEDIUM");
  });

  it("classifie 404 comme LOW", () => {
    expect(classifySeverity(404)).toBe("LOW");
  });

  it("classifie 400 comme LOW", () => {
    expect(classifySeverity(400)).toBe("LOW");
  });
});