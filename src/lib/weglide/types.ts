export type WeGlideUser = {
  id?: number;
  name?: string;
};

export type WeGlideAirport = {
  id?: number;
  name?: string;
  icao?: string;
  country?: { id?: number; name?: string };
  country_name?: string;
};

export type WeGlideClub = {
  id: number;
  name: string;
  region?: string;
  country?: { id?: number; name?: string };
  country_name?: string;
};

export type WeGlideIgcFileRef = {
  id?: number;
  file?: string;
  valid?: number;
  errors?: unknown[];
  logger_manufacturer?: string;
};

export type WeGlideFlight = {
  id: number;
  date?: string;
  scoring_date?: string;
  duration?: number;
  time?: number;
  flight_time?: number;
  takeoff_time?: string;
  landing_time?: string;
  distance?: number;
  points?: number;
  score?: number;
  user?: WeGlideUser;
  pilot?: WeGlideUser;
  igcfile_id?: number;
  igcfile?: WeGlideIgcFileRef | number;
  igc_file?: WeGlideIgcFileRef;
  igc_file_id?: number;
  protected?: boolean;
  launch_airport?: WeGlideAirport;
  airport?: WeGlideAirport;
  custom_takeoff_airport?: WeGlideAirport;
  takeoff_airport?: WeGlideAirport;
  [key: string]: unknown;
};

export type WeGlideIgcFile = {
  id: number;
  file: string;
  pilot_name?: string;
  date_utc?: string;
};
