import { DuneClient, ParameterType } from "@duneanalytics/client-sdk";

const DUNE_QUERY_ID = 3799716;

export async function fetchDuneData(
  duneClient: DuneClient,
  limit: number,
  offset: number
) {
  const queryResult = await duneClient.getLatestResult({
    queryId: DUNE_QUERY_ID,
    query_parameters: [
      {
        name: "daysSinceLastAllocate", // Parameter name as defined in the Dune query
        type: ParameterType.NUMBER, // Type of the parameter (e.g., number, string, etc.)
        value: "270", // Value to pass to the parameter
      },
    ],
  });
  if (!queryResult.result || !queryResult.result.rows) {
    throw new Error("No data returned from Dune query.");
  }

  // Get rows in the specified range
  const rows = queryResult.result.rows.slice(offset, offset + limit);
  return rows;
}
