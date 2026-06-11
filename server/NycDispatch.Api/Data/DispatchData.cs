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
    public IReadOnlyList<Vehicle> Vehicles { get; }
    public IReadOnlyList<CallType> CallTypes { get; }

    public DispatchData(IWebHostEnvironment env)
    {
        var dir = Path.Combine(env.ContentRootPath, "Data");

        Stations = LoadCsv(Path.Combine(dir, "stations.csv"), row => new Station
        {
            Id = row["id"],
            Name = row["name"],
            Latitude = ParseDouble(row["latitude"]),
            Longitude = ParseDouble(row["longitude"]),
            Borough = row["borough"],
            Battalion = row["battalion"],
            Division = row["division"],
        });

        Vehicles = LoadCsv(Path.Combine(dir, "vehicles.csv"), row => new Vehicle
        {
            Id = row["id"],
            Callsign = row["callsign"],
            Type = row["type"],
            Status = row["status"],
            StationId = row["station_id"],
        });

        CallTypes = LoadCsv(Path.Combine(dir, "calls.csv"), row => new CallType
        {
            Id = row["id"],
            Name = row["name"],
            Weight = ParseDouble(row["weight"]),
            Radius = ParseDouble(row["radius"]),
        });
    }

    private static double ParseDouble(string value) =>
        double.Parse(value.Trim(), CultureInfo.InvariantCulture);

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
