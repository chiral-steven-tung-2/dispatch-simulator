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

app.MapGet("/api/nypd-stations", (DispatchData data) => Results.Ok(data.NypdStations));
app.MapGet("/api/nypd-stations/{id}", (string id, DispatchData data) =>
    data.NypdStations.FirstOrDefault(s => s.Id == id) is { } station
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

// Spawn-category probabilities (category → probability, summing to 1)
app.MapGet("/api/call-spawn-categories", (DispatchData data) => Results.Ok(data.CallSpawnCategories));

// Mandatory-response assignments (staffing levels and escalation chain)
app.MapGet("/api/assignments", (DispatchData data) => Results.Ok(data.Assignments));

// Scene modifiers — extra units that can be special-called as a fire escalates
app.MapGet("/api/modifiers", (DispatchData data) => Results.Ok(data.Modifiers));

app.Run();
