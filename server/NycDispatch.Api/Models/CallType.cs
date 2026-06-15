namespace NycDispatch.Api.Models;

/// <summary>
/// A category of emergency call that can be spawned in the simulation. Live calls
/// themselves are generated at runtime on the client; this is the catalog/weights.
/// </summary>
public record CallType
{
    public required string Id { get; init; }
    public required string Name { get; init; }
    /// <summary>Relative spawn frequency (higher = more common).</summary>
    public required double Weight { get; init; }
    /// <summary>Response perimeter radius in meters around the call.</summary>
    public required double Radius { get; init; }
    /// <summary>Id of the mandatory-response assignment this call type starts at.</summary>
    public required string AssignmentId { get; init; }
}
