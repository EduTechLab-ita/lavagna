# EduBoard v2 — TODO

## Alta priorità

- [ ] **Pagine multiple**: ogni lezione può avere più pagine, con miniature navigabili
  - Idea: array di canvas state (dataURL), navigazione laterale in basso
  - Salvataggio: JSON con array `pages: [{drawing, background}, ...]`

## Media priorità

- [ ] **Righello e Goniometro — miglioramenti**:
  - Snap più preciso al righello (ora funziona solo per tratti orizzontali)
  - Goniometro: snap alla curva del semicerchio
  - Righello: mostra tacche in cm reali calibrate allo schermo

- [ ] **Strumento lazo**: selezione a forma libera (polygon lasso)
  - Menu contestuale vicino alla selezione con opzioni: copia, incolla, cancella, colora

## Bassa priorità

- [ ] **Calibrazione DPI**: calcolo cm reali per righello basato su DPI schermo
- [ ] **Esportazione PDF multi-pagina**: quando ci sono più pagine
