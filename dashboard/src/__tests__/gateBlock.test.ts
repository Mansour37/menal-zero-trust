// FAILLE VOLONTAIRE — test de la porte jest (tests dashboard). NE JAMAIS FUSIONNER.
// Déposé en dashboard/src/__tests__/gateBlock.test.ts par run-gate-test.sh, puis supprimé.
describe("porte jest (demonstration)", () => {
  it("echoue volontairement pour prouver que la porte bloque", () => {
    expect(1).toBe(2);
  });
});
