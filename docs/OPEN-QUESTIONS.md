# Open Questions — MediaPlan

## Mediator Annual Planning View (vue planning médiateurs)

**Established so far:**
- [x] View is an annual grid: rows = days of the year, columns = mediators,
  one cell per half-day (morning / afternoon) — matches the Excel reference
  file (`MHN_Fonctionnement_ Mediateurs.xlsx`, sheet "MHN 2026")
- [x] Week numbers are ISO 8601, displayed on Monday rows (like "S 37")
- [x] Year is switchable (Excel covers 2023, 2025, 2026, 2027)
- [x] A mediator's cycle (S1, S2, S3...) is displayed once per week (on the
  Monday cell of the third sub-column), valid for the whole ISO week
- [x] Cycle LENGTH is variable per mediator (1 to N weeks), rotating +1 per
  ISO week (observed: S3 → S4 → S1 → S2 for a 4-week cycle)
- [x] Cell colors carry meaning (from the Excel file):
  - orange empty cell = standard presence (worked per cycle)
  - yellow + code (CA, RHS, RTT, AM, CET, Cex, congé parental/maternité/
    naissance, dispo) = paid leave / absence
  - gray + TELE = remote work (télétravail)
  - orange + text (Réf. WE, offre anniv, Stop Motion, Montréal, RDV aux
    Jardins, "amgt JJ/MM", durations like 7:45) = missions / events /
    special arrangements
  - red + code (grève, syndicat, formation) = work-related absence
  - green cells exist (267) — meaning TBD
- [x] Excel also has count columns (ratio, Médiateurs: per-day presence
  counts morning/afternoon) — may or may not be needed in the app
- [x] Excel reference file is CONFIDENTIAL: analyzed locally, never
  committed; only structural findings are documented
- [x] The view is EDITABLE: absences AND cycles are managed in the grid
- [x] Absence types: reuse the existing AbsenceType list, extended with
  the full list of codes from the Excel file (Loic to provide meanings)
- [x] Weekends ARE shown (all days, like the Excel file)

**Open questions:**
- [ ] Exact meaning of the main codes: TP (1696×, 2nd most common), CA,
      RHS, AM, "Réf. WE", "amgt JJ/MM", and the numeric cells (1-19) —
      Loic to provide the legend (needed to extend AbsenceType)
- [ ] Which absence/mission types should the app model natively vs. free
      text? (current AbsenceType: leave, mission, training, sick, other,
      leave_request)
- [ ] Do cycle weeks carry working-hour patterns (LEXICON says each cycle
      week defines precise working days and hours), or is a cycle week
      just a label with presence on fixed weekdays?
- [ ] Where does cycle data live: new WorkCycle/CycleWeek entities (TODO
      section "Work Cycles") — how do they interact with the existing
      Absence entity for display?
- [ ] Should the count columns (per-day presence totals) be reproduced?
