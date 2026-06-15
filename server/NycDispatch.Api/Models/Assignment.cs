namespace NycDispatch.Api.Models;

/// <summary>
/// A mandatory-response staffing level ("assignment") a call is dispatched at.
/// Assignments form an escalation chain via <see cref="UpgradeTo"/>: once a call
/// is fully staffed for its current assignment and has been worked for a while,
/// it may roll <see cref="UpgradeProbability"/> to escalate to the next level.
/// </summary>
public record Assignment
{
    public required string Id { get; init; }
    public required string Name { get; init; }
    /// <summary>Probability (0-1) of escalating to <see cref="UpgradeTo"/> once fully staffed.</summary>
    public required double UpgradeProbability { get; init; }
    /// <summary>Id of the next assignment in the escalation chain, or null if this is the top.</summary>
    public string? UpgradeTo { get; init; }
    public required int Engines { get; init; }
    public required int Trucks { get; init; }
    public required int Rescues { get; init; }
    public required int Squads { get; init; }
    public required int Battalions { get; init; }
    public required int Divisions { get; init; }
    public required int Rac { get; init; }
    public required int Satellite { get; init; }
    public required int Tsu { get; init; }
    public required int Hazmat { get; init; }
}
