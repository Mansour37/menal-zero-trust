import { render, screen } from "@testing-library/react";
import StatsCard from "@/components/StatsCard";

describe("StatsCard", () => {
  it("affiche le titre et la valeur", () => {
    render(<StatsCard title="Requetes totales" value={1234} />);
    expect(screen.getByText("Requetes totales")).toBeInTheDocument();
    expect(screen.getByText("1234")).toBeInTheDocument();
  });

  it("affiche le sous-titre si fourni", () => {
    render(<StatsCard title="Titre" value="42" subtitle="sur les 24 dernieres heures" />);
    expect(screen.getByText("sur les 24 dernieres heures")).toBeInTheDocument();
  });

  it("n affiche pas de sous-titre si absent", () => {
    render(<StatsCard title="Titre" value="42" />);
    expect(screen.queryByText(/dernieres heures/i)).not.toBeInTheDocument();
  });

  it("applique la couleur blue par defaut", () => {
    const { container } = render(<StatsCard title="T" value="V" />);
    const card = container.firstChild as HTMLElement;
    expect(card.className).toContain("blue");
  });

  it("applique la couleur red quand specifie", () => {
    const { container } = render(<StatsCard title="T" value="V" color="red" />);
    const card = container.firstChild as HTMLElement;
    expect(card.className).toContain("red");
  });

  it("accepte une valeur numerique et l affiche comme chaine", () => {
    render(<StatsCard title="T" value={0} />);
    expect(screen.getByText("0")).toBeInTheDocument();
  });
});