{
  description = "Dev shell for Tauri + React (macOS)";

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
        export CC="$(xcrun --sdk macosx -f clang)"
        export CXX="$(xcrun --sdk macosx -f clang++)"
        export AR="$(xcrun --sdk macosx -f ar)"
        export RANLIB="$(xcrun --sdk macosx -f ranlib)"
        export CARGO_TARGET_AARCH64_APPLE_DARWIN_LINKER="$CC"
        export CARGO_TARGET_X86_64_APPLE_DARWIN_LINKER="$CC"

        # Komfort
        export RUST_BACKTRACE=1
      '';
    };
  };
}
