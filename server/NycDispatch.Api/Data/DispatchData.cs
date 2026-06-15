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
    public IReadOnlyList<Assignment> Assignments { get; }

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
        });

        CallTypes = LoadCsv(Path.Combine(dir, "fdny_calls.csv"), row => new CallType
        {
            Id = row["id"],
            Name = row["name"],
            Weight = ParseDouble(row["weight"]),
            Radius = ParseDouble(row["radius"]),
            AssignmentId = row["assignment_id"],
        });

        Assignments = LoadCsv(Path.Combine(dir, "fdny_assignments.csv"), row => new Assignment
        {
            Id = row["assignment_id"],
            Name = row["name"],
            UpgradeProbability = ParseDouble(row["upgrade_probability"]),
            UpgradeTo = ParseUpgradeTo(row["upgrade_to"]),
            Engines = ParseInt(row["engines"]),
            Trucks = ParseInt(row["trucks"]),
            Rescues = ParseInt(row["rescues"]),
            Squads = ParseInt(row["squads"]),
            Battalions = ParseInt(row["battalions"]),
            Divisions = ParseInt(row["divisions"]),
            Rac = ParseInt(row["rac"]),
            Satellite = ParseInt(row["satellite"]),
            Tsu = ParseInt(row["tsu"]),
            Hazmat = ParseInt(row["hazmat"]),
        });
    }

    private static double ParseDouble(string value) =>
        double.Parse(value.Trim(), CultureInfo.InvariantCulture);

    private static int ParseInt(string value) =>
        int.Parse(value.Trim(), CultureInfo.InvariantCulture);

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
