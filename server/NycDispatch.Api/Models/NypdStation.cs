namespace NycDispatch.Api.Models;

public record NypdStation
{
    public required string Id { get; init; }
    public required string Name { get; init; }
    public required string Address { get; init; }
    public required double Latitude { get; init; }
    public required double Longitude { get; init; }
}