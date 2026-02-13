(() => {
  const output = document.querySelector('[data-form-output]');

  const serializeForm = (form) => {
    const data = new FormData(form);
    const entries = [];

    for (const [key, value] of data.entries()) {
      entries.push(`${key}: ${value}`);
    }

    return entries.join(' | ');
  };

  document.querySelectorAll('form[data-capture]').forEach((form) => {
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      if (!output) return;

      const summary = serializeForm(form);
      output.textContent = summary || 'Form submitted without visible values.';
    });
  });

  document.querySelectorAll('[data-toggle-pressed]').forEach((button) => {
    button.addEventListener('click', () => {
      const isPressed = button.getAttribute('aria-pressed') === 'true';
      button.setAttribute('aria-pressed', String(!isPressed));
    });
  });
})();
