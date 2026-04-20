export interface LessonStep {
  id: string;
  title: string;
  content: string; // markdown string
}

export interface Lesson {
  slug: string;
  title: string;
  description: string;
  icon: string;
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  duration: string;
  tags: string[];
  starterTemplate?: string;
  steps: LessonStep[];
}

export const lessons: Lesson[] = [
  {
    slug: "intro-to-git",
    title: "Git Fundamentals",
    description:
      "Learn the core Git workflow — init, stage, commit, branch, and merge — hands-on in a live terminal.",
    icon: "🌿",
    difficulty: "Beginner",
    duration: "25 min",
    tags: ["git", "version-control"],
    steps: [
      {
        id: "what-is-git",
        title: "What is Git?",
        content: `## What is Git?

Git is a **distributed version control system** that tracks changes in your source code during software development. It was created by Linus Torvalds in 2005.

### Why use Git?

- **History** — every change is recorded, so you can go back in time
- **Collaboration** — multiple people can work on the same codebase safely
- **Branching** — experiment freely without breaking the main code

> 💡 Git stores data as **snapshots** of your project, not as file diffs.

### Key concepts

| Term | Meaning |
|------|---------|
| Repository (repo) | A project folder tracked by Git |
| Commit | A saved snapshot of your changes |
| Branch | An independent line of development |
| Remote | A copy of the repo hosted elsewhere (GitHub, GitLab…) |

In the editor on the right, open a terminal (\`Ctrl+\`\`\` in VS Code) and run:

\`\`\`bash
git --version
\`\`\`

You should see something like \`git version 2.x.x\`.`,
      },
      {
        id: "init-repo",
        title: "Initialize a Repository",
        content: `## Initializing a Git Repository

Let's create your first Git repo.

### Step 1 — Create a project folder

In the terminal on the right:

\`\`\`bash
mkdir my-project && cd my-project
\`\`\`

### Step 2 — Initialize Git

\`\`\`bash
git init
\`\`\`

Git creates a hidden \`.git\` folder. This is the "brain" of your repo — never delete it manually.

### Step 3 — Check the status

\`\`\`bash
git status
\`\`\`

You'll see:

\`\`\`
On branch main
No commits yet
nothing to commit (create/copy files and use "git add" to track)
\`\`\`

> 💡 \`git status\` is your best friend. Run it constantly.`,
      },
      {
        id: "stage-commit",
        title: "Stage & Commit",
        content: `## Staging and Committing

The Git workflow has two steps: **stage** then **commit**.

\`\`\`
Working Directory → Staging Area → Repository
     (edit)             (add)        (commit)
\`\`\`

### Create a file

\`\`\`bash
echo "# My Project" > README.md
\`\`\`

### Stage it

\`\`\`bash
git add README.md
# or stage everything:
git add .
\`\`\`

### Commit it

\`\`\`bash
git commit -m "Initial commit: add README"
\`\`\`

### View the log

\`\`\`bash
git log --oneline
\`\`\`

You'll see your commit hash and message. 🎉`,
      },
      {
        id: "branching",
        title: "Branching",
        content: `## Working with Branches

Branches let you develop features in isolation.

### Create a branch

\`\`\`bash
git checkout -b feature/hello-world
\`\`\`

### Make changes

\`\`\`bash
echo 'print("Hello, World!")' > hello.py
git add hello.py
git commit -m "Add hello world script"
\`\`\`

### Switch back to main

\`\`\`bash
git checkout main
\`\`\`

Notice \`hello.py\` is gone — it lives only on the feature branch!

### Merge the branch

\`\`\`bash
git merge feature/hello-world
\`\`\`

Now your change is in \`main\`. ✅

### Clean up

\`\`\`bash
git branch -d feature/hello-world
\`\`\``,
      },
    ],
  },
  {
    slug: "docker-basics",
    title: "Docker Essentials",
    description:
      "Containerize your first application — write a Dockerfile, build an image, and run containers like a pro.",
    icon: "🐳",
    difficulty: "Intermediate",
    duration: "35 min",
    tags: ["docker", "containers", "devops"],
    steps: [
      {
        id: "what-is-docker",
        title: "What is Docker?",
        content: `## What is Docker?

Docker is a platform for building and running **containers** — lightweight, portable units that package your app with all its dependencies.

### Containers vs VMs

| | Containers | Virtual Machines |
|---|---|---|
| Startup | Milliseconds | Minutes |
| Size | MBs | GBs |
| Isolation | Process-level | Full OS |
| Performance | Near-native | Overhead |

### Key terminology

- **Image** — a read-only blueprint (like a class)
- **Container** — a running instance of an image (like an object)
- **Dockerfile** — a recipe that builds an image
- **Registry** — a store for images (Docker Hub, GHCR…)

Verify Docker is running:

\`\`\`bash
docker info
docker run hello-world
\`\`\``,
      },
      {
        id: "write-dockerfile",
        title: "Write a Dockerfile",
        content: `## Writing your first Dockerfile

Let's containerize a simple Python web app.

### Create the app

\`\`\`bash
mkdir docker-app && cd docker-app
cat > app.py << 'EOF'
from http.server import HTTPServer, BaseHTTPRequestHandler

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.end_headers()
        self.wfile.write(b"Hello from Docker! 🐳")

HTTPServer(("", 8080), Handler).serve_forever()
EOF
\`\`\`

### Write the Dockerfile

\`\`\`bash
cat > Dockerfile << 'EOF'
FROM python:3.12-slim

WORKDIR /app
COPY app.py .

EXPOSE 8080
CMD ["python", "app.py"]
EOF
\`\`\`

### Build the image

\`\`\`bash
docker build -t my-app:latest .
\`\`\``,
      },
      {
        id: "run-container",
        title: "Run a Container",
        content: `## Running Containers

### Start your container

\`\`\`bash
docker run -d -p 8080:8080 --name my-app my-app:latest
\`\`\`

Flags explained:
- \`-d\` — detached (background) mode
- \`-p 8080:8080\` — map host port → container port
- \`--name\` — give it a friendly name

### Test it

\`\`\`bash
curl http://localhost:8080
# Hello from Docker! 🐳
\`\`\`

### Inspect logs

\`\`\`bash
docker logs my-app
\`\`\`

### Stop & remove

\`\`\`bash
docker stop my-app
docker rm my-app
\`\`\``,
      },
    ],
  },
  {
    slug: "kubernetes-intro",
    title: "Kubernetes Basics",
    description:
      "Deploy your first app to a Kubernetes cluster — pods, services, deployments, and kubectl fundamentals.",
    icon: "☸️",
    difficulty: "Advanced",
    duration: "45 min",
    tags: ["kubernetes", "k8s", "k3s", "devops"],
    steps: [
      {
        id: "k8s-concepts",
        title: "Core Concepts",
        content: `## Kubernetes Core Concepts

Kubernetes (K8s) is an open-source system for **automating deployment, scaling, and management** of containerized applications.

### The control loop

K8s continuously reconciles the **desired state** (what you declare) with the **actual state** (what's running).

### Building blocks

| Resource | Purpose |
|----------|---------|
| **Pod** | Smallest unit — wraps one or more containers |
| **Deployment** | Manages replica sets, rolling updates |
| **Service** | Stable network endpoint for a set of pods |
| **Namespace** | Virtual cluster for resource isolation |
| **ConfigMap** | Key-value config, injected into pods |
| **Secret** | Like ConfigMap but for sensitive data |

### Check your cluster

\`\`\`bash
kubectl cluster-info
kubectl get nodes
\`\`\``,
      },
      {
        id: "first-deployment",
        title: "Your First Deployment",
        content: `## Deploying an App to K8s

### Create a deployment

\`\`\`bash
kubectl create deployment nginx --image=nginx:alpine
\`\`\`

### Watch it come up

\`\`\`bash
kubectl get pods -w
\`\`\`

Press \`Ctrl+C\` when the pod shows \`Running\`.

### Expose it as a service

\`\`\`bash
kubectl expose deployment nginx \\
  --port=80 \\
  --type=NodePort
\`\`\`

### Get the URL (k3s)

\`\`\`bash
kubectl get svc nginx
\`\`\`

Use the \`NODE_PORT\` shown and your node IP to open the app.

### Scale it

\`\`\`bash
kubectl scale deployment nginx --replicas=3
kubectl get pods
\`\`\`

Three pods are now load-balanced by the service! 🚀`,
      },
      {
        id: "write-manifests",
        title: "Write YAML Manifests",
        content: `## Declarative Configuration with YAML

Infrastructure-as-code: describe what you want, K8s makes it happen.

### deployment.yaml

\`\`\`yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app
  namespace: default
spec:
  replicas: 2
  selector:
    matchLabels:
      app: my-app
  template:
    metadata:
      labels:
        app: my-app
    spec:
      containers:
        - name: my-app
          image: nginx:alpine
          ports:
            - containerPort: 80
          resources:
            requests:
              memory: "64Mi"
              cpu: "50m"
            limits:
              memory: "128Mi"
              cpu: "200m"
\`\`\`

### Apply it

\`\`\`bash
kubectl apply -f deployment.yaml
kubectl get deploy my-app
\`\`\`

### Update it (edit replicas, then re-apply)

\`\`\`bash
sed -i 's/replicas: 2/replicas: 4/' deployment.yaml
kubectl apply -f deployment.yaml
kubectl rollout status deployment/my-app
\`\`\``,
      },
    ],
  },
];

export function getLessonBySlug(slug: string): Lesson | undefined {
  return lessons.find((l) => l.slug === slug);
}

export function getLessonTemplateSlug(lesson: Lesson): string {
  return lesson.starterTemplate ?? lesson.slug;
}

export function resolveLessonTemplateSlug(
  lessonSlug: string | null | undefined,
): string | undefined {
  if (!lessonSlug) return undefined;

  const lesson = getLessonBySlug(lessonSlug);
  if (!lesson) return undefined;

  return getLessonTemplateSlug(lesson);
}

export const lessonTemplateSlugs = Array.from(
  new Set(lessons.map(getLessonTemplateSlug)),
);
