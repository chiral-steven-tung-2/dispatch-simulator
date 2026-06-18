namespace NycDispatch.Api.Models;

public class Modifier
{
    public string Id { get; set; } = "";
    public string Name { get; set; } = "";
    /// <summary>Assignment level at which this modifier's probability is rolled.</summary>
    public string TriggerAssignment { get; set; } = "";
    /// <summary>Call categories this modifier applies to; empty list means any category.</summary>
    public List<string> CallCategories { get; set; } = new();
    /// <summary>Probability (0–1) that this modifier fires when its trigger condition is met.</summary>
    public double Probability { get; set; }
    /// <summary>
    /// "additional" — unit counts are stacked on top of the alarm assignment.
    /// "required"   — unit counts set a minimum floor; units already covered by the
    ///                assignment are not sent again.
    /// </summary>
    public string ModifierType { get; set; } = "additional";
    public int Engine { get; set; }
    public int Ladder { get; set; }
    public int Rescue { get; set; }
    public int Squad { get; set; }
    public int Squad2piece { get; set; }
    public int Battalion { get; set; }
    public int Division { get; set; }
    public int Rac { get; set; }
    public int Satellite { get; set; }
    public int Tsu { get; set; }
    public int Msu { get; set; }
    public int Fieldcomm { get; set; }
    public int Mcp { get; set; }
    public int Hazmat { get; set; }
    public int Htmu { get; set; }
    public int Hazmatsupport { get; set; }
    public int Hazmatbattalion { get; set; }
    public int Rescuebattalion { get; set; }
    public int Safetybattalion { get; set; }
    public int Brush { get; set; }
    public int Collapse { get; set; }
    public int Purplek { get; set; }
    public int Imt { get; set; }
    public int Highrise { get; set; }
    public int Thawing { get; set; }
    public int PatrolCar { get; set; }
}
