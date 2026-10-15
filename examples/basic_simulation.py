"""Baseline simulation script (evolved from original akıllı ev.txt prototype)."""
import os
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from src.simulator import HEMSSimulator

if __name__ == "__main__":
    sim = HEMSSimulator(threshold_w=2000, solar_power_w=300, battery_capacity_wh=1700)
    res = sim.run()
    print("Baseline PoC Simulation Finished.")
    print(f"Base Cost: ${res['base_cost']:.2f} | Shifted Cost: ${res['shifted_cost']:.2f} | Savings: ${res['savings']:.2f}")
