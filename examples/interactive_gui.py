"""Interactive GUI with CheckButtons toggle controls (evolved from first.py)."""
import os
import sys
import numpy as np
import matplotlib.pyplot as plt
from matplotlib.widgets import CheckButtons

# Add parent directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from src.simulator import HEMSSimulator

def launch_interactive_gui():
    sim = HEMSSimulator(threshold_w=2100, solar_power_w=200, battery_capacity_wh=1700)
    res = sim.run()

    fig, ax = plt.subplots(figsize=(12, 6))
    l_base, = ax.plot(res['hours'], res['base_profile'], label="Base Load Profile", linewidth=3, linestyle="-.", color="purple")
    l_shifted, = ax.plot(res['hours'], res['shifted_profile'], label="Shifted Load Profile", linestyle=":", linewidth=3, color="green")
    l_battery, = ax.plot(res['hours'], res['battery_profile'], label="Battery Profile", linestyle="-.", linewidth=3, color="blue")
    l_solar,   = ax.plot(res['hours'], res['solar_output'], label="Solar Output", linestyle="-.", linewidth=3, color="orange")
    ax.axhline(sim.threshold, color="red", linestyle="--", label="Threshold (2100W)")

    ax.set_title("Interactive Daily Load Profile with Curve Toggles")
    ax.set_xlabel("Hour of Day")
    ax.set_ylabel("Power Consumption (W)")
    ax.set_xticks(range(24))
    ax.legend(loc="upper left")
    ax.grid(True)

    lines = [l_base, l_shifted, l_battery, l_solar]
    labels = [line.get_label() for line in lines]
    visibility = [True] * len(lines)

    rax = plt.axes([0.72, 0.65, 0.16, 0.22])
    check = CheckButtons(rax, labels, visibility)

    def toggle(label):
        idx = labels.index(label)
        lines[idx].set_visible(not lines[idx].get_visible())
        plt.draw()

    check.on_clicked(toggle)
    print("Launching interactive GUI window...")
    plt.show()

if __name__ == "__main__":
    launch_interactive_gui()
