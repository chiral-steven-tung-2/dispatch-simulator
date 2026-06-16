using System.Globalization;
using System.Text;
using NycDispatch.Api.Models;

namespace NycDispatch.Api.Data;

/// <summary>
/// In-memory source of truth for stations, vehicles, and calls.
/// Data is loaded once at startup from CSV files in the Data folder, which makes
/// it easy to edit/import in a spreadsheet. Registered as a singleton.
/// </summary>
public class DispatchData
{
    public IReadOnlyList<Station> Stations { get; }
    public IReadOnlyList<NycDispatch.Api.Models.NypdStation> NypdStations { get; }
    public IReadOnlyList<Vehicle> Vehicles { get; }
    public IReadOnlyList<CallType> CallTypes { get; }
    public IReadOnlyList<CallSpawnCategory> CallSpawnCategories { get; }
    public IReadOnlyList<Assignment> Assignments { get; }
    public IReadOnlyList<Modifier> Modifiers { get; }

    public DispatchData(IWebHostEnvironment env)
    {
        var dir = Path.Combine(env.ContentRootPath, "Data");

        Stations = LoadCsv(Path.Combine(dir, "fdny_stations.csv"), row => new Station
        {
            Id = row["id"],
            Name = row["name"],
            Latitude = ParseDouble(row["latitude"]),
            Longitude = ParseDouble(row["longitude"]),
            Borough = row["borough"],
            Battalion = row["battalion"],
            Division = row["division"],
        });

        NypdStations = LoadCsv(Path.Combine(dir, "nypd_stations.csv"), row => new NycDispatch.Api.Models.NypdStation
        {
            Id = Slugify(row["name"]),
            Name = row["name"],
            Address = row["address"],
            Latitude = ParseDouble(row["latitude"]),
            Longitude = ParseDouble(row["longitude"]),
            AssignedPatrolCars = ParseInt(row["assigned_patrol_cars"]),
        });

        Vehicles = LoadCsv(Path.Combine(dir, "fdny_vehicles.csv"), row => new Vehicle
        {
            Id = row["id"],
            Callsign = row["callsign"],
            Type = row["type"],
            Status = row["status"],
            StationId = row["station_id"],
            FfCount = ParseInt(row["ff_count"]),
        });

        CallTypes = LoadCsv(Path.Combine(dir, "fdny_calls.csv"), row => new CallType
        {
            Id = row["id"],
            Name = row["name"],
            Category = row["category"],
            Radius = ParseDouble(row["radius"]),
            AssignmentId = row["base_assignment"],
            SpawnBorough = row["spawn_borough"],
        });

        CallSpawnCategories = LoadCsv(Path.Combine(dir, "fdny_call_spawn.csv"), row => new CallSpawnCategory
        {
            Id = row["id"],
            Category = row["category"],
            Probability = ParseDouble(row["probability"]),
        });

        Assignments = LoadCsv(Path.Combine(dir, "fdny_assignments.csv"), row => new Assignment
        {
            Id = row["assignment_id"],
            Name = row["name"],
            UpgradeProbability = ParseDouble(row["upgrade_probability"]),
            UpgradeTo = ParseUpgradeTo(row["upgrade_to"]),
            MinResolveS = ParseInt(row["min_resolve_s"]),
            MaxResolveS = ParseInt(row["max_resolve_s"]),
            Engine = ParseIntSafe(row, "engine"),
            Ladder = ParseIntSafe(row, "ladder"),
            Rescue = ParseIntSafe(row, "rescue"),
            Squad = ParseIntSafe(row, "squad"),
            Squad2piece = ParseIntSafe(row, "squad2piece"),
            Battalion = ParseIntSafe(row, "battalion"),
            Division = ParseIntSafe(row, "division"),
            Rac = ParseIntSafe(row, "rac"),
            Satellite = ParseIntSafe(row, "satellite"),
            Tsu = ParseIntSafe(row, "tsu"),
            Msu = ParseIntSafe(row, "msu"),
            Fieldcomm = ParseIntSafe(row, "fieldcomm"),
            Mcp = ParseIntSafe(row, "mcp"),
            Hazmat = ParseIntSafe(row, "hazmat"),
            Htmu = ParseIntSafe(row, "HTMU"),
            Hazmatsupport = ParseIntSafe(row, "hazmatsupport"),
            Hazmatbattalion = ParseIntSafe(row, "hazmatbattalion"),
            Rescuebattalion = ParseIntSafe(row, "rescuebattalion"),
            Safetybattalion = ParseIntSafe(row, "safetybattalion"),
            Brush = ParseIntSafe(row, "brush"),
            Collapse = ParseIntSafe(row, "collapse"),
            Purplek = ParseIntSafe(row, "purplek"),
            Imt = ParseIntSafe(row, "imt"),
            Highrise = ParseIntSafe(row, "highrise"),
            Thawing = ParseIntSafe(row, "thawing"),
        });

        Modifiers = LoadCsv(Path.Combine(dir, "fdny_modifiers.csv"), row => new Modifier
        {
            Id = row.TryGetValue("modifier_id", out var mid) ? mid.Trim() : row["id"],
            Name = row["name"],
            TriggerAssignment = row["trigger_assignment"],
            CallCategories = row.TryGetValue("call_categories", out var cats)
                ? cats.Split('|', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).ToList()
                : new List<string>(),
            Probability = ParseDouble(row["probability"]),
            ModifierType = row.TryGetValue("modifier_type", out var mt) ? mt.Trim() : "additional",
            Engine = ParseIntSafe(row, "engine"),
            Ladder = ParseIntSafe(row, "ladder"),
            Rescue = ParseIntSafe(row, "rescue"),
            Squad = ParseIntSafe(row, "squad"),
            Squad2piece = ParseIntSafe(row, "squad2piece"),
            Battalion = ParseIntSafe(row, "battalion"),
            Division = ParseIntSafe(row, "division"),
            Rac = ParseIntSafe(row, "rac"),
            Satellite = ParseIntSafe(row, "satellite"),
            Tsu = ParseIntSafe(row, "tsu"),
            Msu = ParseIntSafe(row, "msu"),
            Fieldcomm = ParseIntSafe(row, "fieldcomm"),
            Mcp = ParseIntSafe(row, "mcp"),
            Hazmat = ParseIntSafe(row, "hazmat"),
            Htmu = ParseIntSafe(row, "HTMU"),
            Hazmatsupport = ParseIntSafe(row, "hazmatsupport"),
            Hazmatbattalion = ParseIntSafe(row, "hazmatbattalion"),
            Rescuebattalion = ParseIntSafe(row, "rescuebattalion"),
            Safetybattalion = ParseIntSafe(row, "safetybattalion"),
            Brush = ParseIntSafe(row, "brush"),
            Collapse = ParseIntSafe(row, "collapse"),
            Purplek = ParseIntSafe(row, "purplek"),
            Imt = ParseIntSafe(row, "imt"),
            Highrise = ParseIntSafe(row, "highrise"),
            Thawing = ParseIntSafe(row, "thawing"),
        });
    }

    private static double ParseDouble(string value) =>
        double.Parse(value.Trim(), CultureInfo.InvariantCulture);

    private static int ParseInt(string value) =>
        int.Parse(value.Trim(), CultureInfo.InvariantCulture);

    /// <summary>Returns 0 if the column is absent from this CSV row.</summary>
    private static int ParseIntSafe(IReadOnlyDictionary<string, string> row, string key) =>
        row.TryGetValue(key, out var value) ? ParseInt(value) : 0;

    /// <summary>The CSV uses "None" or an empty cell to mark the top of the escalation chain.</summary>
    private static string? ParseUpgradeTo(string value)
    {
        var trimmed = value.Trim();
        return trimmed.Length == 0 || trimmed.Equals("None", StringComparison.OrdinalIgnoreCase)
            ? null
            : trimmed;
    }

    private static string Slugify(string value)
    {
        var builder = new StringBuilder();
        var previousDash = false;

        foreach (var c in value.Trim().ToLowerInvariant())
        {
            if (char.IsLetterOrDigit(c))
            {
                builder.Append(c);
                previousDash = false;
            }
            else if (!previousDash)
            {
                builder.Append('-');
                previousDash = true;
            }
        }

        return builder.ToString().Trim('-');
    }

    /// <summary>
    /// Reads a CSV file (first row = headers) and maps each data row through the
    /// given factory. Header lookups are case-insensitive.
    /// </summary>
    private static List<T> LoadCsv<T>(
        string path,
        Func<IReadOnlyDictionary<string, string>, T> map)
    {
        if (!File.Exists(path))
        {
            throw new FileNotFoundException($"Data file not found: {path}");
        }

        var result = new List<T>();
        string[]? headers = null;

        foreach (var line in File.ReadAllLines(path))
        {
            if (string.IsNullOrWhiteSpace(line))
            {
                continue;
            }
            var fields = ParseLine(line);
            if (headers is null)
            {
                headers = fields.Select(h => h.Trim()).ToArray();
                continue;
            }

            var row = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            for (var i = 0; i < headers.Length && i < fields.Count; i++)
            {
                row[headers[i]] = fields[i];
            }
            result.Add(map(row));
        }

        return result;
    }

    /// <summary>Splits one CSV line, honoring quoted fields and escaped quotes.</summary>
    private static List<string> ParseLine(string line)
    {
        var fields = new List<string>();
        var sb = new StringBuilder();
        var inQuotes = false;

        for (var i = 0; i < line.Length; i++)
        {
            var c = line[i];
            if (inQuotes)
            {
                if (c == '"')
                {
                    if (i + 1 < line.Length && line[i + 1] == '"')
                    {
                        sb.Append('"');
                        i++;
                    }
                    else
                    {
                        inQuotes = false;
                    }
                }
                else
                {
                    sb.Append(c);
                }
            }
            else if (c == '"')
            {
                inQuotes = true;
            }
            else if (c == ',')
            {
                fields.Add(sb.ToString());
                sb.Clear();
            }
            else
            {
                sb.Append(c);
            }
        }

        fields.Add(sb.ToString());
        return fields;
    }
}
