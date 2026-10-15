"""Core HEMS optimization engine for load shifting and tariff calculation."""
import numpy as np
import matplotlib.pyplot as plt
from .solar import SolarPV
from .battery import BatteryStorage
from .appliances import ApplianceManager

DEFAULT_TARIFF = {
    "peak": 0.50,     # 17:00 - 22:00 ($/kWh)
    "mid": 0.30,      # 06:00 - 17:00 ($/kWh)
    "off_peak": 0.10  # 22:00 - 06:00 ($/kWh)
}

class HEMSSimulator:
    """Simulates smart home energy dispatch, BESS charging, and priority load shifting."""
    def __init__(self, threshold_w=2500, peak_hours=None, off_peak_hours=None,
                 solar_power_w=300, battery_capacity_wh=1700, tariff=None, appliance_file=None):
        self.threshold = threshold_w
        self.peak_hours = peak_hours or list(range(17, 22))
        self.off_peak_hours = off_peak_hours or (list(range(22, 24)) + list(range(0, 6)))
        self.tariff = tariff or DEFAULT_TARIFF
        
        self.solar = SolarPV(rated_power_w=solar_power_w)
        self.battery = BatteryStorage(capacity_wh=battery_capacity_wh)
        self.appliance_mgr = ApplianceManager(data_source=appliance_file)

    def run(self):
        """Executes the complete HEMS simulation pipeline."""
        hours = np.arange(24)
        solar_output = self.solar.get_hourly_output()
        base_profile = self.appliance_mgr.calculate_base_profile()
        
        shifted_profile = base_profile.copy()
        battery_profile = np.zeros(24)
        solar_power_used = np.zeros(24)

        # 1. Solar absorption and Peak Shaving via Battery
        for hour in range(24):
            # Mid-day / Off-peak: Charge battery using available solar output
            if hour not in self.peak_hours:
                chg = self.battery.charge(solar_output[hour])
                battery_profile[hour] += chg
                solar_power_used[hour] = chg
            # Peak hours: Discharge battery to relieve grid strain
            else:
                excess_load = max(0.0, shifted_profile[hour] - self.threshold)
                if excess_load > 0:
                    dischg = self.battery.discharge(excess_load)
                    battery_profile[hour] -= dischg
                    shifted_profile[hour] -= dischg

        # 2. Priority-Based Load Shifting for remaining peak load over threshold
        df_sorted = self.appliance_mgr.df.sort_values(by="Priority", ascending=False)
        for hour in self.peak_hours:
            while shifted_profile[hour] > self.threshold:
                shifted_any = False
                for _, row in df_sorted.iterrows():
                    # Only shift lower-priority appliances (Priority > 1)
                    if row["Priority"] > 1 and hour in row["Time Slots"]:
                        power = row["Power (W)"]
                        shifted_profile[hour] -= power
                        for off_h in self.off_peak_hours:
                            if shifted_profile[off_h] + power <= self.threshold:
                                shifted_profile[off_h] += power
                                shifted_any = True
                                break
                        break
                if not shifted_any:
                    break

        # 3. Calculate Energy Costs
        base_cost = self._compute_cost(base_profile)
        shifted_cost = self._compute_cost(shifted_profile)

        return {
            "hours": hours,
            "base_profile": base_profile,
            "shifted_profile": shifted_profile,
            "battery_profile": battery_profile,
            "solar_output": solar_output,
            "solar_power_used": solar_power_used,
            "base_cost": base_cost,
            "shifted_cost": shifted_cost,
            "savings": base_cost - shifted_cost
        }

    def _compute_cost(self, profile):
        cost = 0.0
        for h in range(24):
            if h in self.peak_hours:
                rate = self.tariff["peak"]
            elif 6 <= h < 17:
                rate = self.tariff["mid"]
            else:
                rate = self.tariff["off_peak"]
            cost += (profile[h] / 1000.0) * rate
        return cost
