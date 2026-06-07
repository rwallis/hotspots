export type ThermalDto = {
  id: string;
  lat: number;
  lon: number;
  pilot: string;
  avgClimbKts: number;
  avgClimbFpm: number | null;
  altFt: number | null;
  flight: string;
  year: number;
};

export type HotspotDto = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  avgClimbKts: number;
  topAltFt: number | null;
  count: number;
  pilot: string;
  pilots: string[];
  years: number[];
  flights?: string[];
};

export type SyncSourceDto = {
  type: "club" | "airport";
  id: number;
  label: string;
};

export type SyncStatusDto = {
  year: number;
  status: string;
  totalFlights: number;
  importedFlights: number;
  analyzedFlights: number;
  analysisPhase: string | null;
  hotspotsProcessed: number;
  hotspotsTotal: number;
  sourceType: string | null;
  sourceId: string | null;
  sourceLabel: string | null;
  errorMessage: string | null;
  lastRunAt: string | null;
};

export type TrackPoint = {
  timeSec: number;
  lat: number;
  lon: number;
  altM: number;
};

export type DetectedThermal = {
  lat: number;
  lon: number;
  avgClimbKts: number;
  avgClimbFpm: number;
  altFt: number;
  durationSec: number;
};

export type SearchResultDto = {
  id: number;
  label: string;
  subtitle: string | null;
};

export type SourceWithPilotsDto = {
  sourceKey: string;
  label: string;
  type: "club" | "airport" | "upload";
  pilots: string[];
  flightCount: number;
};
