"""Solar photovoltaic generation module."""
import numpy as np

DEFAULT_HOURLY_IRRADIANCE = [
    0.0, 0.0, 0.0, 0.0, 0.0, 20.39, 461.84, 689.81, 844.62, 915.64,
    898.18, 793.38, 608.26, 355.69, 10.56, 0.0, 0.0, 0.0, 0.0, 0.0,
    0.0, 0.0, 0.0, 0.0
]

class SolarPV:
    """Models a residential Solar Photovoltaic panel array."""
    def __init__(self, rated_power_w=300.0, irradiance_profile=None):
        self.rated_power_w = rated_power_w
        self.irradiance = irradiance_profile or DEFAULT_HOURLY_IRRADIANCE

    def get_hourly_output(self):
        """Calculates power output (W) for each hour (0..23)."""
        return np.array([(irr / 1000.0) * self.rated_power_w for irr in self.irradiance])
