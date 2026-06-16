namespace NycDispatch.Api.Models;

/// <summary>
/// A spawn-probability entry from fdny_call_spawn.csv. The client picks a category
/// by probability then selects uniformly from all CallTypes in that category.
/// </summary>
public record CallSpawnCategory
{
    public required string Id { get; init; }
    public required string Category { get; init; }
    /// <summary>Fractional probability (0–1) that this category is chosen on a spawn roll.</summary>
    public required double Probability { get; init; }
}
