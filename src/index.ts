import axios, {
  AxiosError,
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
} from "axios";

export interface Build {
  id: number;
  startTime: string;
  finishTime: string;
  status: string;
  result: string;
  sourceBranch: string;
  sourceVersion: string;
}

export interface Commit {
  sha: string;
}

export interface Branch {
  name: string;
  commit: Commit;
}

export interface BranchConfiguration {
  branch: Branch;
  configured: boolean;
  lastBuild: Build;
}

export class AppCenterBuildMonitor {
  private readonly apiClient: AxiosInstance;

  constructor(
    private readonly appName: string,
    private readonly ownerName: string,
    token: string
  ) {
    const config: AxiosRequestConfig = {
      baseURL: `https://api.appcenter.ms/v0.1/apps/${this.ownerName}/${this.appName}`,
      responseType: "json",
      headers: {
        "Content-Type": "application/json",
        "X-API-Token": token,
      },
    };
    this.apiClient = axios.create(config);
  }

  //send request to AppCenter Api using axios
  public getBuildById = async (buildId: number): Promise<Build> => {
    const response: AxiosResponse = await this.apiClient.get(
      `/builds/${buildId}`
    );
    const build: Build = response.data;
    return build;
  };

  public getBranches = async (): Promise<BranchConfiguration[]> => {
    const response: AxiosResponse = await this.apiClient.get(`/branches`);
    const branches: BranchConfiguration[] = response.data;
    return branches || [];
  };

  public startBuild = async (
    branchName: string,
    sourceVersion: string
  ): Promise<Build> => {
    const params = { sourceVersion: sourceVersion };
    const response: AxiosResponse = await this.apiClient.post(
      `/branches/${branchName}/builds`,
      params
    );
    const build: Build = response.data;
    return build;
  };

  public startBuildsOnAllBranches = async (): Promise<void> => {

    //get list of branches
    const branches = await this.getBranches();
    //console.log(branches);

    const buildRequests = branches.map((branch) =>
      this.getBuildById(branch.lastBuild.id)
    );

    //get lastBuilds
    const lastBuilds = await Promise.all(buildRequests);
    console.log(lastBuilds);

    //Start builds
    const startBuildRequests = branches.map((branch) =>
      this.startBuild(branch.branch.name, branch.branch.commit.sha)
    );
    const startedBuilds = await Promise.all(startBuildRequests);

    this.updateStatus(startedBuilds);
  };

  public showReport = (build: Build) => {
    console.log(
      `${build.sourceBranch} ${build.id} ${build.status} https://api.appcenter.ms/v0.1/apps/${this.ownerName}/${this.appName}/builds/${build.id}/logs`
    );
  };
  public updateStatus = async (startedBuilds: Build[]) => {
    startedBuilds.forEach((build: Build) => {
      if (build.status === "completed") this.showReport(build);
    });

    const notCompletedJobs = startedBuilds.filter(
      (build: Build) => build.status !== "completed"
    );

    if (!notCompletedJobs.length) {
      return;
    }

    const buildRequests = notCompletedJobs.map((build: Build) => {
      return this.getBuildById(build.id);
    });

    //Get updated status
    const builds = await Promise.all(buildRequests);

    setTimeout(this.updateStatus, 60000, builds);
  };
}