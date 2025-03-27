<div class="spinner"></div>

<!-- via https://loading.io/css/ -->

<style>
  .spinner {
    display: inline-block;
    width: 20px;
    height: 20px;
  }
  .spinner:after {
    content: ' ';
    display: block;
    width: 16px;
    height: 16px;
    margin: 2px;
    border-radius: 50%;
    border: 2px solid #000000;
    border-color: #000000 transparent #000000 transparent;
    animation: spinner 1.2s linear infinite;
  }
  @keyframes spinner {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }
</style>
