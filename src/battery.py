"""Battery Energy Storage System (BESS) module."""

class BatteryStorage:
    """Models residential battery storage with state of charge limits and C-rate boundaries."""
    def __init__(self, capacity_wh=1700.0, initial_soc_ratio=0.1,
                 charge_rate_ratio=0.2, discharge_rate_ratio=0.3,
                 max_charge_ratio=0.8, min_discharge_ratio=0.3):
        self.capacity_wh = capacity_wh
        self.soc = initial_soc_ratio * capacity_wh
        self.charge_rate = charge_rate_ratio * capacity_wh
        self.discharge_rate = discharge_rate_ratio * capacity_wh
        self.max_charge = max_charge_ratio * capacity_wh
        self.min_discharge = min_discharge_ratio * capacity_wh

    def charge(self, available_power_w):
        """Charges battery using available green power up to maximum allowable rate & SoC."""
        if self.soc >= self.max_charge:
            return 0.0
        deliverable = min(self.charge_rate, self.max_charge - self.soc, available_power_w)
        deliverable = max(0.0, deliverable)
        self.soc += deliverable
        return deliverable

    def discharge(self, requested_power_w):
        """Discharges battery to supply local load down to minimum allowable discharge SoC."""
        if self.soc <= self.min_discharge:
            return 0.0
        available_energy = self.soc - self.min_discharge
        deliverable = min(self.discharge_rate, available_energy, requested_power_w)
        deliverable = max(0.0, deliverable)
        self.soc -= deliverable
        return deliverable
