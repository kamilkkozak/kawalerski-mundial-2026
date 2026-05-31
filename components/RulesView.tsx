"use client";

export default function RulesView() {
  return (
    <div className="rules">
      <h3>Punktacja</h3>
      <ul>
        <li><b>3 pkt</b> — dokładny wynik meczu</li>
        <li><b>1 pkt</b> — trafione rozstrzygnięcie (zwycięzca lub remis), inny wynik</li>
        <li><b>0 pkt</b> — pudło lub brak typu</li>
        <li><b>+10 pkt</b> — trafiony mistrz świata (na koniec turnieju)</li>
        <li><b>+10 pkt</b> — trafiony król strzelców (na koniec turnieju)</li>
      </ul>

      <h3>Deadline</h3>
      <p>
        Typ na mecz wpiszesz i zmienisz <b>do 60 s przed pierwszym gwizdkiem</b> danego meczu. Po tym
        czasie mecz się blokuje (walidacja po stronie serwera), a brak typu = 0 pkt. Typy specjalne
        (mistrz, król strzelców) blokują się od pierwszego gwizdka całego turnieju.
      </p>

      <h3>Pula nagród</h3>
      <p>Wpisowe 50 zł. Nagrody: 1. miejsce <b>250 zł</b>, 2. miejsce <b>125 zł</b>, 3. miejsce <b>75 zł</b>. Kasę rozliczacie między sobą — apka tylko liczy punkty.</p>

      <h3>Wyniki</h3>
      <p>Wyniki pobierane są automatycznie z football-data.org co kilka minut; admin może je ręcznie skorygować (dogrywka, karne, opóźnienia API).</p>
    </div>
  );
}
