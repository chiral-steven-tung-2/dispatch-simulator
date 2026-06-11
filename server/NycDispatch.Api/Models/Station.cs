namespace NycDispatch.Api.Models;

public record Station
{
    public required string Id { get; init; }
    public required string Name { get; init; }
    public required double Latitude { get; init; }
    public required double Longitude { get; init; }
    public required string Borough { get; init; }
    public required string Battalion { get; init; }
    public required string Division { get; init; }
}
