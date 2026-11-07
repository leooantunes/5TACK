import { provideGateways } from './application/ports';
import { useSession } from './application/stores/sessionStore';
import { API_URL } from './data/config';
import { HttpAuthGateway, HttpLineupGateway, HttpTournamentGateway } from './data/gateways/HttpGateways';
import { HttpClient } from './data/http/HttpClient';
import { createTokenStorage } from './data/storage/TokenStorage';

/**
 * COMPOSITION ROOT: único lugar que conhece as implementações concretas.
 * Para testes ou modo offline, troque aqui por gateways em memória.
 */
const tokens = createTokenStorage();
const http = new HttpClient(API_URL, tokens, () => useSession.getState().expire());

provideGateways({
  auth: new HttpAuthGateway(http, tokens),
  tournaments: new HttpTournamentGateway(http),
  lineups: new HttpLineupGateway(http),
});
