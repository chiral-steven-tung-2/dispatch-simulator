using NycDispatch.Api.Data;

var builder = WebApplication.CreateBuilder(args);

// Serve on a fixed port so the frontend can target it predictably.
builder.WebHost.UseUrls("http://localhost:5174");

// In-memory source of truth for all game data.
builder.Services.AddSingleton<DispatchData>();

const string FrontendCors = "frontend";
builder.Services.AddCors(options =>
{
    options.AddPolicy(FrontendCors, policy =>
        policy.WithOrigins("http://localhost:5173")
              .AllowAnyHeader()
              .AllowAnyMethod());
});

var app = builder.Build();

app.UseCors(FrontendCors);

app.MapGet("/", () => Results.Ok(new { service = "NYC Dispatch Simulator API", status = "ok" }));

// Stations
app.MapGet("/api/stations", (DispatchData data) => Results.Ok(data.Stations));
app.MapGet("/api/stations/{id}", (string id, DispatchData data) =>
    data.Stations.FirstOrDefault(s => s.Id == id) is { } station
        ? Results.Ok(station)
        : Results.NotFound());

// Vehicles
app.MapGet("/api/vehicles", (DispatchData data) => Results.Ok(data.Vehicles));
app.MapGet("/api/vehicles/{id}", (string id, DispatchData data) =>
    data.Vehicles.FirstOrDefault(v => v.Id == id) is { } vehicle
        ? Results.Ok(vehicle)
        : Results.NotFound());

// Call types (catalog used by the client to spawn random calls)
app.MapGet("/api/call-types", (DispatchData data) => Results.Ok(data.CallTypes));

app.Run();
