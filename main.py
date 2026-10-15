"""Main execution entry point for Smart HEMS Simulator."""
import matplotlib.pyplot as plt
from src.simulator import HEMSSimulator

def main():
    print("=" * 60)
    print("[HEMS] Smart Home Energy Management System Simulator")
    print("=" * 60)

    sim = HEMSSimulator(threshold_w=2500, solar_power_w=300, battery_capacity_wh=1700)
    results = sim.run()

    print("\nFinancial Analysis:")
    print(f"  - Unmanaged Base Cost   : ${results['base_cost']:.2f}")
    print(f"  - Optimized Shifted Cost: ${results['shifted_cost']:.2f}")
    pct = (results['savings'] / results['base_cost'] * 100) if results['base_cost'] > 0 else 0
    print(f"  - Total Daily Savings   : ${results['savings']:.2f} ({pct:.1f}%)")

    # Plot results
    plt.figure(figsize=(12, 6))
    plt.plot(results['hours'], results['base_profile'], label="Base Load Profile", linewidth=2)
    plt.plot(results['hours'], results['shifted_profile'], label="Shifted Profile with BESS", linestyle="--", linewidth=2)
    plt.plot(results['hours'], results['battery_profile'], label="Battery Activity (W)", linewidth=2)
    plt.axhline(sim.threshold, color="red", linestyle=":", label=f"Threshold ({sim.threshold}W)")
    plt.title("24-Hour Residential Load Optimization with Solar & Storage")
    plt.xlabel("Hour of Day")
    plt.ylabel("Power (W)")
    plt.xticks(range(24))
    plt.legend()
    plt.grid(True)
    plt.show()

if __name__ == "__main__":
    main()
