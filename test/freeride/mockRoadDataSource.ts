import type { RoadDataSource } from '../../src/freeride/roadDataSource';
import type { Tile } from '../../src/freeride/tiles';
import type { OsmWay } from '../../src/freeride/types';

/**
 * RoadDataSource für Tests: liefert feste Straßen oder die Antwort einer Funktion, ohne Netz.
 * Merkt sich jede angefragte Kachel (`requested`).
 */
export class MockRoadDataSource implements RoadDataSource {
  readonly name = 'mock';
  readonly requested: Tile[] = [];

  constructor(private readonly answer: OsmWay[] | ((tile: Tile) => Promise<OsmWay[]> | OsmWay[]) = []) {}

  get calls(): number {
    return this.requested.length;
  }

  async loadTile(tile: Tile): Promise<OsmWay[]> {
    this.requested.push(tile);
    return typeof this.answer === 'function' ? this.answer(tile) : this.answer;
  }
}
