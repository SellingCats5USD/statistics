import numpy as np
import matplotlib.pyplot as plt

# --- Parameters ---
N_POP = 1000          # Number of individuals
STEPS = 100           # Number of generations
RADIUS = 5.0          # Size of environmental fit circle
VELOCITY = np.array([0.15, 0.05])  # Movement per time step
MUTATION_BLUR = 0.4   # SD of the neighborhood sampling (variance)
INITIAL_SPREAD = 2.0  # Initial uniform spread width

# --- Initialization ---
# Start with a uniform distribution centered at origin
pop = np.random.uniform(-INITIAL_SPREAD, INITIAL_SPREAD, (N_POP, 2))
env_center = np.array([0.0, 0.0])

history = []

# --- Simulation Loop ---
for t in range(STEPS):
    # 1. Move the environment
    env_center += VELOCITY
    
    # 2. Selection: Find who is inside the intersection (G_t ∩ E_t)
    distances = np.linalg.norm(pop - env_center, axis=1)
    survivors = pop[distances <= RADIUS]
    
    # Check for extinction
    if len(survivors) == 0:
        print(f"Extinction at step {t}!")
        break
        
    # 3. Sampling: Replace the dead by sampling from survivors
    # We bootstrap back to N_POP
    indices = np.random.choice(len(survivors), size=N_POP, replace=True)
    new_gen = survivors[indices]
    
    # 4. Mutation: Add the "blur" (neighborhood distribution)
    mutation = np.random.normal(0, MUTATION_BLUR, size=(N_POP, 2))
    pop = new_gen + mutation
    
    history.append((pop.copy(), env_center.copy()))

# --- Visualization ---
if history:
    fig, ax = plt.subplots(figsize=(8, 8))
    last_pop, last_env = history[-1]

    ax.scatter(last_pop[:, 0], last_pop[:, 1], s=5, alpha=0.6, label="Genepool")
    circle = plt.Circle(last_env, RADIUS, color='green', fill=False, lw=2, label="Environment")
    ax.add_patch(circle)

    ax.set_title(f"Genepool at Step {len(history)} (v={VELOCITY})")
    ax.legend()
    plt.axis('equal')
    plt.grid(True, alpha=0.3)
    plt.show()