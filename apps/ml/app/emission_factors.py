"""
Emission factor table for spend-based carbon accounting.

Methodology follows GHG Protocol Scope 3.1 category-based estimation, the same
approach used by Climatiq / Doconomy / Aspiration. Factors are expressed as
kg CO2e per INR 100 spent, so:

    co2e_kg = (amount_inr / 100) * factor_per_100

Sources: India's Central Electricity Authority (CEA) CO2 Baseline Database for
electricity, and published lifecycle emission estimates for fuels and travel.
These are proxy estimates, never lab measurements.
"""

# kg CO2e per 100 INR spent
EMISSION_FACTORS: dict[str, float] = {
    "FUEL": 2.5,            # petrol/diesel combustion
    "TRAVEL_PRIVATE": 1.4,  # car/taxi rides
    "TRAVEL_PUBLIC": 0.35,  # bus/train - lower per rupee
    "ELECTRICITY": 1.9,     # CEA grid emission intensity
    "GROCERIES": 0.45,      # mostly local, low processed footprint
    "DINING": 0.8,
    "EDUCATION": 0.15,
    "HEALTHCARE": 0.4,
    "ELECTRONICS": 2.2,     # embodied manufacturing emissions
    "CLOTHING": 1.1,
    "HOUSING": 0.6,
    "RENT": 0.25,
    "BILL_PAYMENT": 0.2,    # paperless utility bills
    "RECHARGE": 0.05,
    "SAVINGS": 0.0,
    "LOAN": 0.0,
    "TRANSFER": 0.0,
    "SALARY": 0.0,
    "GREEN_REWARD": 0.0,
    "OFFSET": -1.0,         # negative = carbon removed
    "OTHER": 0.5,
}

# Green (low-carbon) spending categories that award bonus green points
GREEN_CATEGORIES: dict[str, int] = {
    "TRAVEL_PUBLIC": 30,
    "GROCERIES": 15,
    "BILL_PAYMENT": 20,
    "RECHARGE": 15,
    "EDUCATION": 10,
    "OFFSET": 50,
}

POINTS_PER_KG_SAVED = 12  # reward points when a user beats their own prior month

CATEGORY_LABELS: dict[str, str] = {
    "FUEL": "Fuel",
    "TRAVEL_PRIVATE": "Private travel",
    "TRAVEL_PUBLIC": "Public transport",
    "ELECTRICITY": "Electricity",
    "GROCERIES": "Groceries",
    "DINING": "Dining out",
    "EDUCATION": "Education",
    "HEALTHCARE": "Healthcare",
    "ELECTRONICS": "Electronics",
    "CLOTHING": "Clothing",
    "HOUSING": "Housing",
    "RENT": "Rent",
    "SALARY": "Income",
    "TRANSFER": "Transfer",
    "BILL_PAYMENT": "Bill payment",
    "RECHARGE": "Recharge",
    "LOAN": "Loan",
    "SAVINGS": "Savings",
    "GREEN_REWARD": "Green reward",
    "OFFSET": "Carbon offset",
    "OTHER": "Other",
}


def co2e_for(category: str, amount_inr: float) -> float:
    """Estimated kg CO2e for a spend in a given category."""
    factor = EMISSION_FACTORS.get(category.upper(), EMISSION_FACTORS["OTHER"])
    return round((amount_inr / 100.0) * factor, 4)


def points_for(category: str) -> int:
    """Green points earned purely from the spending choice."""
    return GREEN_CATEGORIES.get(category.upper(), 0)