"""Appliances profile and priority scheduling module."""
import json
import os
import pandas as pd
import numpy as np

class ApplianceManager:
    """Manages appliance list, priority levels, and 24h baseline load aggregation."""
    def __init__(self, data_source=None):
        if data_source is None:
            # Default fallback data
            self.df = pd.DataFrame({
                "Appliance": ["Refrigerator", "Heater", "Lighting", "Kettle", "Air Fryer", "Microwave",
                              "Induction Cooker", "Air Conditioner", "Blender", "Iron", "Dishwasher",
                              "Washing Machine", "Coffee Machine", "TV"],
                "Power (W)": [200, 1700, 100, 500, 950, 500, 1500, 1500, 250, 750, 840, 700, 1000, 100],
                "Priority": [1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 4, 4, 3, 5],
                "Time Slots": [
                    list(range(0, 24)), list(range(17, 22)), list(range(15, 22)),
                    [18], [19], [16], [17, 18], [], [13], [21], [20], [21, 22], [14],
                    list(range(18, 22))
                ]
            })
        elif isinstance(data_source, str) and os.path.exists(data_source):
            with open(data_source, "r", encoding="utf-8") as f:
                items = json.load(f)
            self.df = pd.DataFrame({
                "Appliance": [x["name"] for x in items],
                "Power (W)": [x["power_w"] for x in items],
                "Priority": [x["priority"] for x in items],
                "Time Slots": [x["time_slots"] for x in items]
            })
        else:
            self.df = data_source

    def calculate_base_profile(self):
        """Aggregates unoptimized 24-hour baseline power demand (W)."""
        profile = np.zeros(24)
        for _, row in self.df.iterrows():
            for hour in row["Time Slots"]:
                if 0 <= hour < 24:
                    profile[hour] += row["Power (W)"]
        return profile
