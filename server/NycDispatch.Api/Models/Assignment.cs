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
    /// <summary>Minimum on-scene work time (game-seconds) before the call can auto-resolve.</summary>
    public required int MinResolveS { get; init; }
    /// <summary>Maximum on-scene work time (game-seconds) before the call auto-resolves.</summary>
    public required int MaxResolveS { get; init; }
    public required int Engine { get; init; }
    public required int Ladder { get; init; }
    public required int Rescue { get; init; }
    public required int Squad { get; init; }
    public required int Squad2piece { get; init; }
    public required int Battalion { get; init; }
    public required int Division { get; init; }
    public required int Rac { get; init; }
    public required int Satellite { get; init; }
    public required int Tsu { get; init; }
    public required int Msu { get; init; }
    public required int Fieldcomm { get; init; }
    public required int Mcp { get; init; }
    public required int Hazmat { get; init; }
    public required int Htmu { get; init; }
    public required int Hazmatsupport { get; init; }
    public required int Hazmatbattalion { get; init; }
    public required int Rescuebattalion { get; init; }
    public required int Safetybattalion { get; init; }
    public required int Brush { get; init; }
    public required int Collapse { get; init; }
    public required int Purplek { get; init; }
    public required int Imt { get; init; }
    public required int Highrise { get; init; }
    public required int Thawing { get; init; }
}
