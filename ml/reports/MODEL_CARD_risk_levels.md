# Model card: combined risk levels (LOW / MEDIUM / HIGH / CRITICAL)

**What it does.** Combines the early-warning probability, a learning risk from the predicted mark, and a knowledge-gap risk into one 0–100 score and a level shown to faculty.

**How it was set.** On OULAD validation presentations: learning risk learned from the predicted mark, attendance/learning weight 0.75, level cut-offs {'MEDIUM': 28.1, 'HIGH': 46.4, 'CRITICAL': 71.9}. The knowledge-gap weight is hand-set and untested (not testable on OULAD (no concept data); keeps hand-set weight 0.35).

## Results on unseen presentations
AUC: data-driven 0.800 vs hand-set 0.781 (early-warning model alone 0.799).

| Level | Target rate | Hand-set: n / observed | Data-driven: n / observed |
|---|---|---|---|
| LOW | < 25% | 676 / 15.1% | 1321 / 16.8% |
| MEDIUM | 25–50% | 1802 / 30.8% | 888 / 35.2% |
| HIGH | 50–75% | 891 / 62.6% | 901 / 51.7% |
| CRITICAL | > 75% | 424 / 93.9% | 683 / 89.6% |

data-driven score AUC 0.800 vs hand-set 0.781 (+0.019); levels now map to observed fail-or-withdraw rates on unseen presentations
