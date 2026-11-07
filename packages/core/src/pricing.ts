/**
 * Preço virtual dos jogadores, proporcional ao desempenho recente.
 * Mantém o mercado equilibrado: estrelas custam caro, apostas custam pouco.
 */

export interface PricingRules {
  minPrice: number;
  maxPrice: number;
  /** Arredonda para múltiplos deste valor (ex.: 1.000). */
  step: number;
}

export const DEFAULT_PRICING: PricingRules = {
  minPrice: 120_000,
  maxPrice: 320_000,
  step: 1_000,
};

/**
 * Converte a média recente de pontos por mapa em preço, por interpolação linear
 * entre a menor e a maior média do torneio.
 */
export function priceFromAverages(
  averages: Record<string, number>,
  rules: PricingRules = DEFAULT_PRICING,
): Record<string, number> {
  const values = Object.values(averages);
  if (values.length === 0) return {};
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min;

  const out: Record<string, number> = {};
  for (const [playerId, avg] of Object.entries(averages)) {
    const t = span === 0 ? 0.5 : (avg - min) / span;
    const raw = rules.minPrice + t * (rules.maxPrice - rules.minPrice);
    out[playerId] = Math.round(raw / rules.step) * rules.step;
  }
  return out;
}
