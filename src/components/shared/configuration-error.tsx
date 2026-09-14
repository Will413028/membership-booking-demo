export function ConfigurationError() {
  return (
    <section className="page-shell py-20">
      <div
        className="rounded-3xl border border-coral bg-paper p-8"
        role="alert"
      >
        <p className="text-sm font-bold uppercase tracking-[0.16em] text-coral">
          CONFIGURATION_ERROR
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold">
          Demo configuration is incomplete
        </h1>
        <p className="mt-3 text-muted-foreground">
          This environment is missing required demo configuration. Check the
          deployment settings without exposing credentials in the browser.
        </p>
      </div>
    </section>
  );
}
