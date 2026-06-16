namespace NycDispatch.Api.Models;

// Stored as plain strings so the JSON wire format matches the frontend exactly
// (e.g. "En Route", "Aerial Ladder"), avoiding enum-name mismatches.
public record Vehicle
{
    public required string Id { get; init; }
    public required string Callsign { get; init; }

    /// <summary>e.g. "Engine", "Aerial Ladder", "Tower Ladder", "HazMat", "Battalion"</summary>
    public required string Type { get; init; }

    /// <summary>"Available" | "En Route" | "On Scene"</summary>
    public required string Status { get; init; }

    /// <summary>Id of the station this vehicle is quartered at.</summary>
    public required string StationId { get; init; }

    /// <summary>Number of firefighters staffing this unit.</summary>
    public required int FfCount { get; init; }
}
