export default function Integritetspolicy() {
  return (
    <main className="min-h-screen bg-(--beige) px-4 py-12">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8">
          <a href="/" className="text-2xl font-bold text-(--teal)">📖 Edly</a>
        </div>

        <div className="rounded-2xl bg-white p-8 shadow-sm space-y-8">
          <div>
            <h1 className="text-2xl font-bold text-(--teal)">Dataskyddspolicy</h1>
            <p className="mt-2 text-sm text-(--text-mid)">Senast uppdaterad: april 2025</p>
          </div>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-(--teal)">1. Personuppgiftsansvarig</h2>
            <p className="text-sm text-(--text-dark) leading-relaxed">
              Edly är personuppgiftsansvarig för de uppgifter som behandlas inom tjänsten. Kontakta oss på{' '}
              <a href="mailto:johan@edly.se" className="text-(--teal) underline">johan@edly.se</a> vid frågor om hur vi hanterar dina uppgifter.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-(--teal)">2. Vilka uppgifter samlar vi in</h2>
            <p className="text-sm text-(--text-dark) leading-relaxed">Vi samlar in följande uppgifter när du registrerar dig:</p>
            <ul className="list-disc pl-5 space-y-1 text-sm text-(--text-dark)">
              <li>Förälderns namn och e-postadress</li>
              <li>Barnets förnamn och ålder</li>
              <li>Vilket eller vilka ämnen barnet behöver stöd i</li>
              <li>Eventuell diagnos eller inlärningssvårighet</li>
              <li>Övrig information som du frivilligt anger</li>
            </ul>
            <p className="text-sm text-(--text-dark) leading-relaxed">
              För lärare samlar vi även in telefonnummer, undervisningsbakgrund och motivationsbrev.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-(--teal)">3. Varför vi behandlar uppgifterna</h2>
            <p className="text-sm text-(--text-dark) leading-relaxed">Uppgifterna används uteslutande för att:</p>
            <ul className="list-disc pl-5 space-y-1 text-sm text-(--text-dark)">
              <li>Matcha barn med lämpliga lärare baserat på ämne och behov</li>
              <li>Kommunicera med dig om matchningsprocessen</li>
              <li>Administrera tjänsten och hantera ditt konto</li>
            </ul>
            <p className="text-sm text-(--text-dark) leading-relaxed">
              Den rättsliga grunden för behandlingen är ditt samtycke, som du lämnar i samband med registreringen.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-(--teal)">4. Känsliga uppgifter</h2>
            <p className="text-sm text-(--text-dark) leading-relaxed">
              Diagnosinformation är en känslig personuppgift enligt GDPR. Vi behandlar denna information konfidentiellt och delar den enbart med den lärare som matchas med ditt barn — och enbart i den mån det är nödvändigt för att anpassa undervisningen.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-(--teal)">5. Vem ser uppgifterna</h2>
            <ul className="list-disc pl-5 space-y-1 text-sm text-(--text-dark)">
              <li><strong>Edly-administratörer</strong> — för att hantera matchningar och kvalitetssäkra tjänsten</li>
              <li><strong>Matchad lärare</strong> — ser barnets namn, ålder, ämnen och relevant information inför undervisningen</li>
              <li>Uppgifterna delas inte med tredje part i marknadsföringssyfte</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-(--teal)">6. Hur länge sparas uppgifterna</h2>
            <p className="text-sm text-(--text-dark) leading-relaxed">
              Vi sparar dina uppgifter så länge ditt barn är aktivt i tjänsten. Om du avslutar ditt konto raderas dina personuppgifter inom 30 dagar, med undantag för uppgifter vi är skyldiga att spara enligt lag.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-(--teal)">7. Dina rättigheter</h2>
            <p className="text-sm text-(--text-dark) leading-relaxed">Enligt GDPR har du rätt att:</p>
            <ul className="list-disc pl-5 space-y-1 text-sm text-(--text-dark)">
              <li>Få tillgång till de uppgifter vi har om dig</li>
              <li>Begära rättelse av felaktiga uppgifter</li>
              <li>Begära radering av dina uppgifter ("rätten att bli glömd")</li>
              <li>Återkalla ditt samtycke när som helst</li>
              <li>Lämna klagomål till Integritetsskyddsmyndigheten (IMY)</li>
            </ul>
            <p className="text-sm text-(--text-dark) leading-relaxed">
              Kontakta oss på{' '}
              <a href="mailto:johan@edly.se" className="text-(--teal) underline">johan@edly.se</a>{' '}
              för att utöva dina rättigheter.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-(--teal)">8. Säkerhet</h2>
            <p className="text-sm text-(--text-dark) leading-relaxed">
              Alla uppgifter lagras krypterat i EU-baserad infrastruktur. Åtkomst till känsliga uppgifter är begränsad och loggas.
            </p>
          </section>

          <div className="border-t border-(--beige-dark) pt-6">
            <a href="/" className="text-sm font-semibold text-(--teal) hover:underline">← Tillbaka till startsidan</a>
          </div>
        </div>
      </div>
    </main>
  )
}
