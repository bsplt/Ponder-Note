{
  description = "Dev shell for Tauri + Svelte (macOS)";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";

  outputs = { self, nixpkgs }:
  let
    system = "aarch64-darwin"; # Apple Silicon. Für Intel: x86_64-darwin
    pkgs = import nixpkgs { inherit system; };
  in {
    devShells.${system}.default = pkgs.mkShell {
      packages = [
        pkgs.nodejs_20
        pkgs.pnpm
        pkgs.rustc
        pkgs.cargo

        # Hilft manchmal bei nativen Node-Modulen / Build-Skripten:
        pkgs.pkg-config
      ];

      shellHook = ''
        # macOS SDK aus Xcode CLT verfügbar machen
        export SDKROOT="$(xcrun --sdk macosx --show-sdk-path)"
        export DEVELOPER_DIR="$(xcode-select -p)"

        # Komfort
        export RUST_BACKTRACE=1
      '';
    };
  };
}