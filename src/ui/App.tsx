/**
 * Anwendungsgeruest. Die eigentlichen Screens kommen in Meilenstein 3;
 * hier steht bereits das Layout, das die Bannerhoehe fest reserviert.
 */
export function App(): React.JSX.Element {
  return (
    <div className="app-shell">
      <main className="app-content flex flex-col items-center justify-center gap-3 px-6 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">Bridgelet</h1>
        <p className="text-sm text-slate-400">Brücken-Logikrätsel</p>
        <p className="max-w-xs text-xs text-slate-500">
          Projektgerüst steht. Spiellogik, Rendering und Werbung folgen in den Meilensteinen 1 bis
          5.
        </p>
      </main>
      {/* Fest reservierte Flaeche fuer den Anchored Banner — nie ueberlagert der Banner Inhalt. */}
      <div className="app-banner-slot" />
    </div>
  );
}
